import { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

interface Props {
  src: string | null;
  onTimeUpdate?: (time: number) => void;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(({ src, onTimeUpdate }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        videoRef.current.play().catch(() => {});
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);
    };
    video.addEventListener('timeupdate', handler);
    return () => video.removeEventListener('timeupdate', handler);
  }, [onTimeUpdate]);

  if (!src) {
    return (
      <div className="aspect-[9/16] max-h-[500px] bg-gray-900 rounded-xl flex items-center justify-center text-gray-500">
        영상 없음
      </div>
    );
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        controls
        className="w-full max-h-[500px] rounded-xl bg-black object-contain"
        playsInline
      />
      <div className="absolute bottom-12 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {currentTime.toFixed(1)}s
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
