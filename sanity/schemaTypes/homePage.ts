import { defineArrayMember, defineField, defineType } from "sanity";

export const homePage = defineType({
  name: "homePage",
  title: "Page d'accueil",
  type: "document",
  fields: [
    defineField({
      name: "heroLines",
      title: "Lignes du titre",
      description: "Chaque ligne : un mot en noir, un mot en gris.",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "heroLine",
          fields: [
            defineField({ name: "strong", title: "Mot en noir", type: "string" }),
            defineField({ name: "muted", title: "Mot en gris", type: "string" }),
          ],
          preview: {
            select: { a: "strong", b: "muted" },
            prepare: ({ a, b }) => ({ title: `${a ?? ""} ${b ?? ""}`.trim() }),
          },
        }),
      ],
    }),
    defineField({
      name: "heroIntro",
      title: "Paragraphe de présentation",
      type: "text",
      rows: 4,
    }),
  ],
  preview: { prepare: () => ({ title: "Page d'accueil" }) },
});
