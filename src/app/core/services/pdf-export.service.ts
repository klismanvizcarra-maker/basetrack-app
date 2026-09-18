import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {
  private isExporting = false;

  async exportToPdf(elementId: string, filename: string): Promise<boolean> {
    if (this.isExporting) return false;
    this.isExporting = true;

    try {
      const element = document.getElementById(elementId);
      if (!element) {
        console.error(`Elemento con ID #${elementId} no encontrado en el DOM.`);
        this.isExporting = false;
        return false;
      }

      // Renderizar con html2canvas en alta definición (escala 2)
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1024
      });

      const imgData = canvas.toDataURL('image/png', 1.0);

      // Dimensiones A4 en milímetros
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 5;
      const marginY = 5;
      const contentWidth = pageWidth - (marginX * 2); // 200 mm
      const maxContentHeight = pageHeight - (marginY * 2); // 287 mm

      // Calcular altura proporcional
      let renderedHeight = (canvas.height * contentWidth) / canvas.width;
      let finalWidth = contentWidth;
      let finalHeight = renderedHeight;
      let posX = marginX;
      let posY = marginY;

      // Si la altura sobrepasa una sola hoja A4, escalar proporcionalmente para encajar en 1 hoja
      if (renderedHeight > maxContentHeight) {
        const ratio = maxContentHeight / renderedHeight;
        finalHeight = maxContentHeight;
        finalWidth = contentWidth * ratio;
        posX = marginX + (contentWidth - finalWidth) / 2;
      }

      pdf.addImage(imgData, 'PNG', posX, posY, finalWidth, finalHeight, undefined, 'FAST');
      pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

      this.isExporting = false;
      return true;
    } catch (error) {
      console.error('Error al generar PDF directo:', error);
      this.isExporting = false;
      return false;
    }
  }
}
