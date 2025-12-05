import { createContext, useContext, useState, useEffect } from "react";

type CurriculumContextType = {
  curriculumTree: any;
  setCurriculumTree: (tree: any) => void;
};

const CurriculumContext = createContext<CurriculumContextType | null>(null);

export function CurriculumProvider({ children }: { children: any }) {
  const [curriculumTree, setCurriculumTree] = useState<any>(null);

  // 组件挂载时从 localStorage 读取
  useEffect(() => {
    try {
      const saved = localStorage.getItem("curriculumTree");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCurriculumTree(parsed);
      }
    } catch (err) {
      console.error("Failed to load curriculum from storage", err);
    }
  }, []);

  // 写入 localStorage
  useEffect(() => {
    if (curriculumTree) {
      localStorage.setItem("curriculumTree", JSON.stringify(curriculumTree));
    }
  }, [curriculumTree]);

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
