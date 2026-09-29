import { createRoot } from "react-dom/client";
import "../styles.css";
import "./popup.css";
import { Popup } from "./Popup.jsx";

createRoot(document.getElementById("root")).render(<Popup />);
