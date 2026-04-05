import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_workspace/$orgSlug/wiki')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_workspace/$orgSlug/wiki"!</div>
}
