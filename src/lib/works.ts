/**
 * Joins the info files (content collections) with the processed images (media.json).
 * Pages should get their pieces from here, not from either source directly.
 */
import { getCollection, type CollectionEntry } from "astro:content";
import { findMedia, type MediaItem } from "./media";

type WorkData = CollectionEntry<"works">["data"];
type ProjectData = CollectionEntry<"projects">["data"];

export interface Project extends ProjectData { id: string }
export interface Work extends WorkData {
  id: string;
  /** Display name: the piece's own client if set, otherwise the project's name. */
  clientName: string;
  project: Project;
  media: MediaItem;
}

export async function getProjects(): Promise<Project[]> {
  return (await getCollection("projects"))
    .map(p => ({ id: p.id, ...p.data }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function getWorks({ includeHidden = false } = {}): Promise<Work[]> {
  const projects = new Map((await getProjects()).map(p => [p.id, p]));
  const out: Work[] = [];

  for (const entry of await getCollection("works")) {
    const media = findMedia(entry.id);
    if (!media) continue;                       // info file without an image yet
    const projectId = entry.id.split("/")[0];
    const project = projects.get(projectId) ?? { id: projectId, name: projectId, kind: "client", order: 0, hidden: false };
    if (!includeHidden && (entry.data.hidden || project.hidden)) continue;

    out.push({
      ...entry.data,
      id: entry.id,
      award: entry.data.award ?? project.award,
      clientName: entry.data.client ?? project.name,
      project,
      media,
    });
  }

  // Featured first, then by project order, piece order, newest year, title.
  return out.sort((a, b) =>
    Number(b.featured) - Number(a.featured)
    || a.project.order - b.project.order
    || a.order - b.order
    || (b.year ?? 0) - (a.year ?? 0)
    || a.title.localeCompare(b.title));
}

export const getFeatured = async () => (await getWorks()).filter(w => w.featured);
