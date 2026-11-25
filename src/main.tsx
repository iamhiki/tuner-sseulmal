import { render } from "preact";
import { App } from "./app/App";
import "@fontsource/jua/400.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./index.css";

render(<App />, document.getElementById("app")!);
