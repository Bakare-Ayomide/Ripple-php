import { motion } from "framer-motion";

const UploadProgress = ({ value, label }: { value: number; label?: string }) => (
  <div className="w-full">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-display font-bold text-foreground">{label || "Uploading"}</span>
      <span className="text-xs font-display font-extrabold text-primary">{Math.round(value)}%</span>
    </div>
    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
      <motion.div
        className="h-full gradient-brand rounded-full"
        animate={{ width: `${value}%` }}
        transition={{ type: "spring", damping: 24, stiffness: 200 }}
      />
    </div>
  </div>
);

export default UploadProgress;
