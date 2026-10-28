import type { StructureResolver } from "sanity/structure";

// Pages uniques (id fixe) + liste des projets.
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Contenu")
    .items([
      S.listItem()
        .title("Page d'accueil")
        .id("homePage")
        .child(S.document().schemaType("homePage").documentId("homePage")),
      S.listItem()
        .title("Page About")
        .id("aboutPage")
        .child(S.document().schemaType("aboutPage").documentId("aboutPage")),
      S.divider(),
      S.documentTypeListItem("project").title("Projets"),
    ]);
