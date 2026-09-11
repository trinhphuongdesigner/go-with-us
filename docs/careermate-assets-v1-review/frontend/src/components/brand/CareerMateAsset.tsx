import Image, { type ImageProps } from 'next/image';
import { careermateAssets, type CareerMateAssetName } from '@/lib/careermateAssets';

export type CareerMateAssetProps = Omit<ImageProps, 'src' | 'width' | 'height' | 'alt' | 'fill'> & {
  name: CareerMateAssetName;
  /** Keep empty for decoration; describe information that is not already visible in text. */
  alt?: string;
  width?: number;
};

export function CareerMateAsset({ name, alt = '', width = 240, style, ...props }: CareerMateAssetProps) {
  const asset = careermateAssets[name];
  return (
    <Image
      {...props}
      src={asset.src}
      width={width}
      height={Math.round((width * asset.height) / asset.width)}
      alt={alt}
      unoptimized={asset.format === 'svg'}
      style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', ...style }}
    />
  );
}
