export type SliderImage = {
  key: string;
  src: string;
  alt: string;
};

export type SliderProject = {
  id: string;
  title: string;
  type: string | null;
  description: string | null;
  link: string | null;
  linkLabel: string;
  images: SliderImage[];
};
