import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initExtensionProtection } from "./utils/extensionProtection";

// Initialize extension protection before rendering
initExtensionProtection();

createRoot(document.getElementById("root")!).render(<App />);
