// One card in MediaCarousel. A slide with `to` is a link; one without emits
// `select` with its id (e.g. the video section opens its player).
export interface CarouselSlide {
  id: number;
  image: string | null;
  videoUrl?: string | null | undefined;
  label: string;
  title: string;
  action: string;
  actionIcon: string;
  to?: string | undefined;
  play?: boolean | undefined;
}
