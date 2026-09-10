import Image from "next/image";

export function ThemePortrait({ source, alt, sizes }: {
  source: "hero" | "about";
  alt: string;
  sizes: string;
}) {
  return (
    <>
      <Image src={`/artkin-${source}.webp`} alt={alt} width={1024} height={1024} sizes={sizes} fetchPriority="high" className="portrait-light hero-portrait aspect-square h-auto w-full object-cover object-center" />
      <Image src={`/artkin-${source}-dark.webp`} alt={alt} width={1024} height={1024} sizes={sizes} fetchPriority="high" className="portrait-dark hero-portrait aspect-square h-auto w-full object-cover object-center" />
    </>
  );
}
