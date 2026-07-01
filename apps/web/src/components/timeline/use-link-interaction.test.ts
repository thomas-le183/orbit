import { describe, expect, it } from "vitest";
import {
	anchorCode,
	dependencyType,
	resolveLinkTarget,
} from "./use-link-interaction";

describe("dependencyType", () => {
	it("composes the two-letter anchor code", () => {
		expect(anchorCode("finish")).toBe("F");
		expect(anchorCode("start")).toBe("S");
		expect(dependencyType("finish", "start")).toBe("FS");
		expect(dependencyType("start", "finish")).toBe("SF");
		expect(dependencyType("start", "start")).toBe("SS");
		expect(dependencyType("finish", "finish")).toBe("FF");
	});
});

describe("resolveLinkTarget", () => {
	it("reads the task id and anchor from the nearest node element", () => {
		const wrap = document.createElement("div");
		wrap.innerHTML =
			'<span data-link-target="t9" data-link-anchor="finish"><i></i></span>';
		const inner = wrap.querySelector("i");
		expect(resolveLinkTarget(inner)).toEqual({ taskId: "t9", anchor: "finish" });
	});

	it("returns null when no node is under the element", () => {
		const el = document.createElement("div");
		expect(resolveLinkTarget(el)).toBeNull();
	});
});
