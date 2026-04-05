import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/create-workspace')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/create-workspace"!</div>
}
