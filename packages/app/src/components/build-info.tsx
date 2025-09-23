interface BuildInfoProps {
  className?: string;
}

export function BuildInfo({ className = "" }: BuildInfoProps) {
  const buildSha = import.meta.env.VITE_BUILD_SHA;

  if (!buildSha) return null;

  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      Build: {buildSha}
    </div>
  );
}