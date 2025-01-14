"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const whatsapp_1 = require("./whatsapp");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/", routes_1.default);
app.all("*", (_, res) => res.status(404).json({ error: "URL not found" }));
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
(async () => {
    await (0, whatsapp_1.init)();
    app.listen(port, host, () => {
        console.log(`[server]: Server is running at http://${host}:${port}`);
    });
})();
