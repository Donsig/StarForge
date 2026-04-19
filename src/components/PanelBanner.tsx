import { PANEL_IMAGES } from '../data/assets.ts';
import type { PanelImageId } from '../data/assets.ts';

interface PanelBannerProps {
  panel: PanelImageId;
  title: string;
  subtitle: string;
}

export function PanelBanner({ panel, title, subtitle }: PanelBannerProps) {
  const src = PANEL_IMAGES[panel];

  return (
    <div className="panel-banner">
      {src && (
        <img
          src={src}
          alt=""
          className="panel-banner__img"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div className="panel-banner__gradient" />
      <div className="panel-banner__vignette" />
      <div className="panel-banner__content">
        <h1 className="panel-banner__title">{title}</h1>
        <p className="panel-banner__subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
