import { defineArrayMember, defineField, defineType } from "sanity";

export const aboutPage = defineType({
  name: "aboutPage",
  title: "Page About",
  type: "document",
  fields: [
    defineField({ name: "headline", title: "Titre", type: "text", rows: 4 }),
    defineField({
      name: "portrait",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({ name: "alt", title: "Texte alternatif", type: "string" }),
      ],
    }),
    defineField({
      name: "biography",
      title: "Biographie (un élément par paragraphe)",
      type: "array",
      of: [defineArrayMember({ type: "text", rows: 4 })],
    }),
    defineField({
      name: "expertise",
      title: "Expertise (un élément par ligne)",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
    }),
    defineField({
      name: "contactText",
      title: "Texte de contact",
      description: "Liens possibles : [mail](mailto:…) ou [LinkedIn](https://…)",
      type: "text",
      rows: 4,
    }),
  ],
  preview: { prepare: () => ({ title: "Page About" }) },
});
