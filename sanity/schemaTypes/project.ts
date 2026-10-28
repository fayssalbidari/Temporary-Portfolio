import { defineArrayMember, defineField, defineType } from "sanity";

export const project = defineType({
  name: "project",
  title: "Projet",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Nom du projet",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug (optionnel)",
      type: "slug",
      options: { source: "title", maxLength: 96 },
    }),
    defineField({
      name: "projectType",
      title: "Type de projet",
      description:
        "Texte libre : School Project, Alternance Project, Personal Project…",
      type: "string",
      options: {
        list: [
          "School Project",
          "Alternance Project",
          "Personal Project",
          "Freelance Project",
        ],
      },
    }),
    defineField({
      name: "description",
      title: "Texte du projet",
      type: "text",
      rows: 6,
    }),
    defineField({
      name: "link",
      title: "Lien du projet",
      type: "url",
      validation: (rule) =>
        rule.uri({
          scheme: ["http", "https", "mailto"],
          allowRelative: true,
        }),
    }),
    defineField({
      name: "linkLabel",
      title: "Texte du lien",
      type: "string",
      initialValue: "See Project",
    }),
    defineField({
      name: "images",
      title: "Images du projet",
      description:
        "Ajoute, supprime ou réordonne autant d'images que tu veux. La première est la couverture.",
      type: "array",
      of: [
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Texte alternatif",
              type: "string",
            }),
          ],
        }),
      ],
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: "order",
      title: "Ordre dans le slider",
      description: "Plus petit = affiché en premier.",
      type: "number",
      initialValue: 100,
    }),
    defineField({
      name: "isHidden",
      title: "Masquer ce projet",
      type: "boolean",
      initialValue: false,
    }),
  ],
  orderings: [
    {
      title: "Ordre du slider",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "projectType", media: "images.0" },
  },
});
