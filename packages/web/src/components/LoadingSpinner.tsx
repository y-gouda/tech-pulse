export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-accent dark:border-[#333] dark:border-t-green-400" />
    </div>
  );
}
