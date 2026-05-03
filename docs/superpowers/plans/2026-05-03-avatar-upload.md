# Avatar & Logo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace base64 data-URL avatar/logo encoding with direct-to-S3 presigned uploads, storing permanent public URLs in better-auth user/org records.

**Architecture:** The API exposes `POST /api/uploads/presign` which generates a presigned PUT URL for direct browser-to-S3 upload and returns the permanent public URL. `StorageService` initialises the bucket on startup and sets a public-read policy scoped to `avatars/*` and `logos/*` path prefixes only. The frontend gains a `useUploadFile` hook that orchestrates the three-step flow (presign → PUT → return URL), and both settings pages swap their `FileReader.readAsDataURL` logic for that hook.

**Tech Stack:** NestJS (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `class-validator`), React 19 + TanStack Query, Axios, Vitest (web), Jest (API)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/src/storage/storage.service.ts` | Add `onModuleInit` bucket init + public policy, `getPublicUrl()`, `generateBrowserPresignedUrl()` |
| Create | `apps/api/src/uploads/uploads.dto.ts` | `PresignUploadDto` with validation |
| Create | `apps/api/src/uploads/uploads.controller.ts` | `POST /api/uploads/presign` handler |
| Create | `apps/api/src/uploads/uploads.module.ts` | NestJS module |
| Modify | `apps/api/src/app.module.ts` | Register `UploadsModule` |
| Create | `apps/web/src/hooks/use-upload-file.ts` | `useUploadFile` hook |
| Modify | `apps/web/src/components/workspace/settings/profile-settings.tsx` | Use S3 upload |
| Modify | `apps/web/src/components/workspace/settings/general-settings.tsx` | Use S3 upload |

---

## Task 1: Extend StorageService with bucket init and new methods

**Files:**
- Modify: `apps/api/src/storage/storage.service.ts`

- [ ] **Step 1: Replace the full file content**

```typescript
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>("STORAGE_ENDPOINT");
    const forcePathStyle =
      config.get<string>("STORAGE_FORCE_PATH_STYLE") === "true";

    this.client = new S3Client({
      region: config.getOrThrow<string>("STORAGE_REGION"),
      credentials: {
        accessKeyId: config.getOrThrow<string>("STORAGE_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow<string>("STORAGE_SECRET_KEY"),
      },
      ...(endpoint ? { endpoint, forcePathStyle } : {}),
    });

    this.bucket = config.getOrThrow<string>("STORAGE_BUCKET");

    const storageEndpoint = config.get<string>("STORAGE_ENDPOINT") ?? "";
    this.publicBaseUrl = `${storageEndpoint}/${this.bucket}`;
  }

  async onModuleInit() {
    await this.ensureBucketExists();
    await this.ensurePublicReadPolicy();
  }

  private async ensureBucketExists() {
    try {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.bucket }),
      );
      this.logger.log(`Bucket "${this.bucket}" created`);
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? "";
      if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
        this.logger.warn(`Could not create bucket: ${name}`);
      }
    }
  }

  private async ensurePublicReadPolicy() {
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: [
            `arn:aws:s3:::${this.bucket}/avatars/*`,
            `arn:aws:s3:::${this.bucket}/logos/*`,
          ],
        },
      ],
    });
    try {
      await this.client.send(
        new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: policy }),
      );
      this.logger.log(`Public-read policy applied to avatars/* and logos/*`);
    } catch (err: unknown) {
      this.logger.warn(
        `Could not set bucket policy (configure manually if needed): ${(err as Error).message}`,
      );
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async generateBrowserPresignedUrl(
    key: string,
    mimeType: string,
    expiresIn = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    fileSize: number,
    expiresIn = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: fileSize,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
```

- [ ] **Step 2: Verify the API still type-checks**

```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/storage/storage.service.ts
git commit -m "feat(api): add bucket init, getPublicUrl, and browser presign method to StorageService"
```

---

## Task 2: Create UploadsModule

**Files:**
- Create: `apps/api/src/uploads/uploads.dto.ts`
- Create: `apps/api/src/uploads/uploads.controller.ts`
- Create: `apps/api/src/uploads/uploads.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/uploads/uploads.dto.ts`:

```typescript
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  IsInt,
} from "class-validator";

export class PresignUploadDto {
  @Matches(/^image\/(jpeg|png|gif|webp)$/)
  declare mimeType: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024) // 10 MB cap
  declare fileSize: number;

  @IsString()
  @IsNotEmpty()
  declare fileName: string;

  @IsIn(["avatar", "logo"])
  declare purpose: "avatar" | "logo";

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  declare orgId?: string;
}
```

- [ ] **Step 2: Create the controller**

Create `apps/api/src/uploads/uploads.controller.ts`:

```typescript
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { User } from "../auth/auth.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthGuard } from "../common/guards/auth.guard";
import { StorageService } from "../storage/storage.service";
import { PresignUploadDto } from "./uploads.dto";

@UseGuards(AuthGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post("presign")
  async presign(@CurrentUser() user: User, @Body() body: PresignUploadDto) {
    if (body.purpose === "logo" && !body.orgId) {
      throw new BadRequestException("orgId is required for logo uploads");
    }

    const ext = body.fileName.split(".").pop() ?? "bin";
    const key =
      body.purpose === "avatar"
        ? `avatars/${user.id}/${randomUUID()}.${ext}`
        : `logos/${body.orgId}/${randomUUID()}.${ext}`;

    const uploadUrl = await this.storage.generateBrowserPresignedUrl(
      key,
      body.mimeType,
    );
    const publicUrl = this.storage.getPublicUrl(key);

    return { uploadUrl, storageKey: key, publicUrl };
  }
}
```

- [ ] **Step 3: Create the module**

Create `apps/api/src/uploads/uploads.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";

@Module({
  controllers: [UploadsController],
})
export class UploadsModule {}
```

- [ ] **Step 4: Register UploadsModule in AppModule**

In `apps/api/src/app.module.ts`, add `UploadsModule` to the imports array:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ChatModule } from "./chat/chat.module";
import { DbModule } from "./db/db.module";
import { EmailModule } from "./email/email.module";
import { PreferencesModule } from "./preferences/preferences.module";
import { StorageModule } from "./storage/storage.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: [".env", "../../.env"],
    }),
    DbModule,
    StorageModule,
    EmailModule,
    AuthModule,
    BillingModule,
    ChatModule,
    PreferencesModule,
    UploadsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Type-check**

```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/uploads/ apps/api/src/app.module.ts
git commit -m "feat(api): add UploadsModule with POST /api/uploads/presign endpoint"
```

---

## Task 3: Frontend upload hook

**Files:**
- Create: `apps/web/src/hooks/use-upload-file.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/use-upload-file.ts`:

```typescript
import axios from "axios";
import { api } from "@/lib/api";

interface PresignResponse {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
}

export function useUploadFile() {
  async function upload(
    file: File,
    purpose: "avatar" | "logo",
    orgId?: string,
  ): Promise<string> {
    const { data } = await api.post<PresignResponse>("/uploads/presign", {
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      purpose,
      orgId,
    });

    await axios.put(data.uploadUrl, file, {
      headers: { "Content-Type": file.type },
    });

    return data.publicUrl;
  }

  return { upload };
}
```

- [ ] **Step 2: Type-check the web app**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-upload-file.ts
git commit -m "feat(web): add useUploadFile hook for S3 presign-then-PUT flow"
```

---

## Task 4: Update ProfileSettings to use S3 upload

**Files:**
- Modify: `apps/web/src/components/workspace/settings/profile-settings.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
import { Button } from "@orbit/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession, useUpdateUser } from "@/hooks/use-auth";
import { useUploadFile } from "@/hooks/use-upload-file";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { SettingsPage } from "./settings-page";

export function ProfileSettings() {
  const { data: session } = useSession();
  const update = useUpdateUser();
  const { upload } = useUploadFile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarId = useId();
  const nameId = useId();
  const emailId = useId();

  const user = session?.user;
  if (!user) return null;

  function saveName(value: string) {
    if (!user) return;
    const next = value.trim();
    if (next === (user.name ?? "").trim()) return;
    update.mutate(
      { name: next },
      { onSuccess: () => toast.success("Name updated") },
    );
  }

  function saveAvatar(value: string | null) {
    if (!user) return;
    update.mutate(
      { image: value },
      {
        onSuccess: () =>
          toast.success(value ? "Picture updated" : "Picture removed"),
      },
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await upload(file, "avatar");
      saveAvatar(publicUrl);
    } catch {
      toast.error("Upload failed, please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SettingsPage
      title="Profile"
      subtitle="Personal info visible across Orbit."
    >
      <FieldGroup>
        <Field>
          <FieldLabel>Picture</FieldLabel>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-label="Upload picture"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? ""}
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" />
              )}
            </button>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon />
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!user.image || uploading}
                  onClick={() => saveAvatar(null)}
                >
                  <Trash2Icon />
                  Remove
                </Button>
                <input
                  ref={fileInputRef}
                  id={avatarId}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <FieldDescription>
                We support your square PNGs, JPEGs, GIFs and WebPs under 10MB
              </FieldDescription>
            </div>
          </div>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <FieldDescription>Shown everywhere you appear.</FieldDescription>
          </FieldContent>
          <Input
            id={nameId}
            className="w-70 shrink-0"
            defaultValue={user.name ?? ""}
            onBlur={(e) => saveName(e.target.value)}
          />
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor={emailId}>Email</FieldLabel>
            <FieldDescription>
              The email associated to your account
            </FieldDescription>
          </FieldContent>
          <div className="flex w-70 shrink-0 items-center gap-2">
            <Input id={emailId} defaultValue={user.email} disabled />
          </div>
        </Field>
      </FieldGroup>

      <FieldSet className="mt-8">
        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldLabel>Danger zone</FieldLabel>
              <FieldDescription>
                Permanently delete your account and data.
              </FieldDescription>
            </FieldContent>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </Field>
        </FieldGroup>
      </FieldSet>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        userEmail={user.email}
      />
    </SettingsPage>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/settings/profile-settings.tsx
git commit -m "feat(web): use S3 presign upload for user avatar in profile settings"
```

---

## Task 5: Update GeneralSettings to use S3 upload

**Files:**
- Modify: `apps/web/src/components/workspace/settings/general-settings.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
import { Button } from "@orbit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orbit/ui/components/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { useRouter } from "@tanstack/react-router";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useDeleteOrganization, useUpdateOrganization } from "@/hooks/use-auth";
import { useUploadFile } from "@/hooks/use-upload-file";
import { SettingsPage } from "./settings-page";

interface GeneralSettingsProps {
  org: { id: string; name: string; slug: string; logo?: string | null };
  isOwner: boolean;
}

export function GeneralSettings({ org, isOwner }: GeneralSettingsProps) {
  const router = useRouter();
  const update = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const { upload } = useUploadFile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoId = useId();
  const nameId = useId();
  const slugId = useId();

  function saveIf(
    field: "name" | "slug" | "logo",
    value: string,
    prev: string | null | undefined,
  ) {
    const next = value.trim();
    const prevTrimmed = (prev ?? "").trim();
    if (next === prevTrimmed) return;
    update.mutate(
      {
        organizationId: org.id,
        data: { [field]: field === "logo" ? next || null : next },
      },
      { onSuccess: () => toast.success("Saved") },
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Logo must be under 10 MB");
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await upload(file, "logo", org.id);
      saveIf("logo", publicUrl, org.logo);
    } catch {
      toast.error("Upload failed, please try again");
    } finally {
      setUploading(false);
    }
  }

  const canDelete = deleteConfirm === org.name && !deleteOrg.isPending;

  return (
    <SettingsPage
      title="Workspace"
      subtitle="Manage your workspace name, URL, and logo."
    >
      <FieldGroup>
        <Field>
          <FieldLabel>Logo</FieldLabel>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-label="Upload logo"
            >
              {org.logo ? (
                <img
                  src={org.logo}
                  alt={org.name}
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" />
              )}
            </button>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon />
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!org.logo || uploading}
                  onClick={() => saveIf("logo", "", org.logo)}
                >
                  <Trash2Icon />
                  Remove
                </Button>
                <input
                  ref={fileInputRef}
                  id={logoId}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <FieldDescription>
                We support your square PNGs, JPEGs, GIFs and WebPs under 10MB
              </FieldDescription>
            </div>
          </div>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor={nameId}>Workspace name</FieldLabel>
            <FieldDescription>Displayed across the app.</FieldDescription>
          </FieldContent>
          <Input
            id={nameId}
            className="w-70 shrink-0"
            defaultValue={org.name}
            onBlur={(e) => saveIf("name", e.target.value, org.name)}
          />
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor={slugId}>URL slug</FieldLabel>
            <FieldDescription>
              Changing invalidates existing links.
            </FieldDescription>
          </FieldContent>
          <div className="flex w-70 shrink-0">
            <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs text-muted-foreground">
              orbit.app/
            </span>
            <Input
              id={slugId}
              className="rounded-l-none"
              defaultValue={org.slug}
              onBlur={(e) => saveIf("slug", e.target.value, org.slug)}
            />
          </div>
        </Field>
      </FieldGroup>

      {isOwner && (
        <FieldSet className="mt-8">
          <FieldGroup>
            <Field>
              <FieldContent>
                <FieldLabel>Transfer ownership</FieldLabel>
                <FieldDescription>
                  Assign Owner to another member. You become Admin.
                </FieldDescription>
              </FieldContent>
              <Button variant="outline" disabled>
                Transfer
              </Button>
            </Field>
            <Field>
              <FieldContent>
                <FieldLabel>Delete workspace</FieldLabel>
                <FieldDescription>
                  Permanently delete this workspace and all its data.
                </FieldDescription>
              </FieldContent>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete workspace
              </Button>
            </Field>
          </FieldGroup>
        </FieldSet>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              This permanently deletes the workspace and all its data.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Type <strong>{org.name}</strong> to confirm.
          </p>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={org.name}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canDelete}
              onClick={() =>
                deleteOrg.mutate(org.id, {
                  onSuccess: () => router.navigate({ to: "/" }),
                })
              }
            >
              Delete workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/settings/general-settings.tsx
git commit -m "feat(web): use S3 presign upload for workspace logo in general settings"
```

---

## Self-Review

**Spec coverage:** All requirements covered — StorageService extended, bucket made publicly readable for avatars/logos, new presign endpoint, frontend hook, both settings pages updated.

**Placeholder scan:** None found — all steps contain concrete code.

**Type consistency:**
- `generateBrowserPresignedUrl(key, mimeType)` defined in Task 1, called in Task 2 ✓
- `getPublicUrl(key)` defined in Task 1, called in Task 2 ✓
- `useUploadFile` returns `{ upload }` in Task 3, destructured identically in Tasks 4 and 5 ✓
- `PresignUploadDto.purpose` typed `"avatar" | "logo"` in Task 2, called with matching literals in Tasks 4/5 ✓
