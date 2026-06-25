export default function InputField({ label, ...props }) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-[13px] font-medium text-ink-dim">{label}</label>
      )}
      <input
        className="w-full px-[15px] py-[13px] text-[15px] font-sans text-ink bg-surface border border-edge rounded-[11px] outline-none transition-[border,box-shadow] focus:border-accent focus:shadow-ring placeholder:text-ink-faint"
        {...props}
      />
    </div>
  );
}
