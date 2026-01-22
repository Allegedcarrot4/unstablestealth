import { useRef } from 'react';

const PROXY_HOME = 'https://scramjet.mercurywork.shop/';

export const Proxy = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="h-screen">
      <iframe
        ref={iframeRef}
        src={PROXY_HOME}
        className="w-full h-full"
        allow="fullscreen; allow-forms; allow-scripts; allow-same-origin"
        frameBorder={0}
        title="Proxy Browser"
      />
    </div>
  );
};
