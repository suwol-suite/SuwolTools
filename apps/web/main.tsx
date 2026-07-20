import { createRoot } from "react-dom/client";
import { App } from "../../apps/desktop/src/renderer/App";
import "../../apps/desktop/src/renderer/styles.css";

createRoot(document.getElementById("root")!).render(<App />);
