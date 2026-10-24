import Image from "next/image";

export type House = "Atlas" | "Olympus" | "Titan";

const HOUSE_LOGOS: Record<House, string> = {
  Atlas: "/brand/houses/atlas.png",
  Olympus: "/brand/houses/olympus.png",
  Titan: "/brand/houses/titan.png",
};

interface HouseLogoProps {
  house: House;
  size?: number;
  className?: string;
}

export default function HouseLogo({
  house,
  size = 64,
  className = "",
}: HouseLogoProps) {
  return (
    <Image
      src={HOUSE_LOGOS[house]}
      alt={`${house} house logo`}
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}