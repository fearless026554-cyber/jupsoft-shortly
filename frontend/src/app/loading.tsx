export default function Loading() {
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 bg-blue-600/20 overflow-hidden z-50 pointer-events-none">
      <div className="w-1/3 h-full bg-blue-600 animate-pulse" />
    </div>
  );
}
