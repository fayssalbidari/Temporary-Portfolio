import type { SchemaTypeDefinition } from "sanity";
import { aboutPage } from "./aboutPage";
import { homePage } from "./homePage";
import { project } from "./project";

export const schemaTypes: SchemaTypeDefinition[] = [homePage, aboutPage, project];
