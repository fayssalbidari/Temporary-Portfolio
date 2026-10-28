"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { dataset, projectId } from "./lib/sanity/env";
import { schemaTypes } from "./sanity/schemaTypes";
import { structure } from "./sanity/structure";

const singletons = ["homePage", "aboutPage"];

export default defineConfig({
  name: "default",
  title: "Portfolio",
  basePath: "/studio",
  projectId,
  dataset,
  schema: {
    types: schemaTypes,
    templates: (templates) =>
      templates.filter(({ schemaType }) => !singletons.includes(schemaType)),
  },
  document: {
    actions: (input, context) =>
      singletons.includes(context.schemaType)
        ? input.filter(({ action }) => action && action !== "duplicate" && action !== "delete")
        : input,
  },
  plugins: [structureTool({ structure })],
});
