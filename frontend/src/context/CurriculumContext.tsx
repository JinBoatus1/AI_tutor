import { createContext, useContext, useState } from "react";

try {
  const parsedTree =
    typeof tree === "string" ? JSON.parse(tree) : tree;

  setCurriculumTree(parsedTree);
} catch (err) {
  console.error("JSON parse failed", err);
}


const CurriculumContext = createContext<CurriculumContextType | null>(null);

export function CurriculumProvider({ children }: { children: any }) {
  const [curriculumTree, setCurriculumTree] = useState(null);

  return (
    <CurriculumContext.Provider value={{ curriculumTree, setCurriculumTree }}>
      {children}
    </CurriculumContext.Provider>
  );
}

export function useCurriculum() {
  const ctx = useContext(CurriculumContext);
  if (!ctx) throw new Error("useCurriculum must be used inside CurriculumProvider");
  return ctx;
}
