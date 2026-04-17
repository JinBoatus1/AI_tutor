"""Generate fixed test PDF files for AutoGrader testing."""

from pathlib import Path
import fitz  # PyMuPDF


def create_test_pdfs():
    """Create sample PDF files for testing."""
    test_dir = Path(__file__).parent / "test_pdfs"
    test_dir.mkdir(exist_ok=True)
    
    # Student paper 1
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Student Answer Sheet 1")
    page.insert_text((50, 100), "Subject: Mathematics")
    page.insert_text((50, 150), "Problem 1: Solve 2x + 3 = 7")
    page.insert_text((50, 200), "Answer: x = 2")
    page.insert_text((50, 250), "Work: 2x = 4, x = 2")
    student_pdf_1 = test_dir / "student_paper_1.pdf"
    doc.save(str(student_pdf_1))
    doc.close()
    print(f"Created: {student_pdf_1}")
    
    # Student paper 2
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Student Answer Sheet 2")
    page.insert_text((50, 100), "Subject: Physics")
    page.insert_text((50, 150), "Problem 1: Calculate velocity")
    page.insert_text((50, 200), "Given: distance = 100m, time = 5s")
    page.insert_text((50, 250), "Answer: v = 20 m/s")
    student_pdf_2 = test_dir / "student_paper_2.pdf"
    doc.save(str(student_pdf_2))
    doc.close()
    print(f"Created: {student_pdf_2}")
    
    # Answer key
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Official Answer Key")
    page.insert_text((50, 100), "Problem 1 (Math): x = 2 [Full marks]")
    page.insert_text((50, 150), "Problem 2 (Physics): v = 20 m/s [Full marks]")
    page.insert_text((50, 200), "All solutions shown with correct methodology")
    answer_pdf = test_dir / "answer_key.pdf"
    doc.save(str(answer_pdf))
    doc.close()
    print(f"Created: {answer_pdf}")
    
    print(f"\nAll test PDFs created in: {test_dir}")
    return student_pdf_1, student_pdf_2, answer_pdf


if __name__ == "__main__":
    create_test_pdfs()
