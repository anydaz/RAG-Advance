export default function Logo() {
  return (
    <div className="flex items-center gap-[11px] mb-9">
      <div className="w-[34px] h-[34px] rounded-[9px] bg-accent flex items-center justify-center shadow-accent-sm">
        <div className="w-[13px] h-[13px] bg-white rounded-[3px] rotate-45" />
      </div>
      <span className="text-[16px] font-semibold tracking-[-0.01em]">
        Knowledge Assistant
      </span>
    </div>
  );
}
