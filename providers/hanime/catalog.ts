import { Catalog } from "../types";

export const catalog: Catalog[] = [
  {
    title: "Trending",
    filter: "/browse/trending",
  },
  {
    title: "Recent Uploads",
    filter: "order=created_at_desc",
  },
  {
    title: "New Releases",
    filter: "order=released_at_desc",
  },
  {
    title: "Most Views",
    filter: "order=views_desc",
  },
  {
    title: "Top Rated",
    filter: "order=likes_desc",
  },
];

export const genres: Catalog[] = [
  { title: "Anal", filter: "/browse/tags/anal" },
  { title: "Big Boobs", filter: "/browse/tags/big%20boobs" },
  { title: "Blow Job", filter: "/browse/tags/blow%20job" },
  { title: "Bondage", filter: "/browse/tags/bondage" },
  { title: "Creampie", filter: "/browse/tags/creampie" },
  { title: "Futanari", filter: "/browse/tags/futanari" },
  { title: "Incest", filter: "/browse/tags/incest" },
  { title: "MILF", filter: "/browse/tags/milf" },
  { title: "School Girl", filter: "/browse/tags/school%20girl" },
  { title: "Succubus", filter: "/browse/tags/succubus" },
  { title: "Vanilla", filter: "/browse/tags/vanilla" },
  { title: "Yuri", filter: "/browse/tags/yuri" },
];
