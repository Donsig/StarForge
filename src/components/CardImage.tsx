import { useState } from 'react';

interface CardImageProps {
  src: string;
  label: string;
  height?: number;
}

export function CardImage({ src, label, height = 110 }: CardImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className="card-image" style={{ height }}>
      {!errored && (
        <img
          src={src}
          alt=""
          className="card-image__img"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
      {(errored || !loaded) && (
        <div className="card-image__placeholder">
          <span className="card-image__label">{label}</span>
        </div>
      )}
    </div>
  );
}
