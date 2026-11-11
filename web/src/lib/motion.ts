export const springPress = {
  scale: 0.94,
  transition: { type: "spring" as const, stiffness: 520, damping: 16, mass: 0.6 },
};

export const springModal = {
  type: "spring" as const,
  stiffness: 300,
  damping: 22,
  mass: 0.72,
};
