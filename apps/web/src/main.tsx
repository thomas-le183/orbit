import "@orbit/ui/globals.css";
import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { router } from "./lib/router";

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Failed to find the root element");
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(<RouterProvider router={router} />);
}
