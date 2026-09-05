// frontend/src/utils/pipelineExport.ts
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Pipeline, PipelineStage } from '../types';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

export function exportPipelineToPDF(pipeline: Pipeline, contactName: string) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text(pipeline.projectName, 14, 22);

  doc.setFontSize(12);
  doc.text(`Contact: ${contactName || pipeline.contactName}`, 14, 32);
  doc.text(`Type: ${pipeline.projectType}`, 14, 38);
  doc.text(`Status: ${pipeline.status}`, 14, 44);
  doc.text(`Created: ${new Date(pipeline.createdAt).toLocaleDateString()}`, 14, 50);
  if (pipeline.completedAt) {
    doc.text(`Completed: ${new Date(pipeline.completedAt).toLocaleDateString()}`, 14, 56);
  }

  // Progress
  const completed = pipeline.stages.filter(s => s.status === 'complete').length;
  const total = pipeline.stages.length;
  const progress = Math.round((completed / total) * 100);
  doc.text(`Progress: ${completed}/${total} (${progress}%)`, 14, 64);

  // Stages table
  const tableData = pipeline.stages.map((stage: PipelineStage) => [
    stage.name,
    stage.status,
    stage.startedAt ? new Date(stage.startedAt).toLocaleDateString() : '-',
    stage.completedAt ? new Date(stage.completedAt).toLocaleDateString() : '-',
    stage.duration ? `${stage.duration} days` : '-',
    stage.description || '',
  ]);

  doc.autoTable({
    startY: 72,
    head: [['Stage', 'Status', 'Started', 'Completed', 'Duration', 'Description']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 133, 244] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, finalY + 10);

  // Save
  doc.save(`${pipeline.projectName.replace(/\s+/g, '_')}_pipeline.pdf`);
}

export function exportPipelineToCSV(pipeline: Pipeline) {
  const headers = ['Stage', 'Status', 'Started', 'Completed', 'Duration (days)', 'Description'];
  const rows = pipeline.stages.map((stage: PipelineStage) => [
    stage.name,
    stage.status,
    stage.startedAt ? new Date(stage.startedAt).toLocaleDateString() : '',
    stage.completedAt ? new Date(stage.completedAt).toLocaleDateString() : '',
    stage.duration?.toString() || '',
    stage.description || '',
  ]);

  const csvContent = [
    `"${pipeline.projectName} - Pipeline Export"`,
    `"Project Type","${pipeline.projectType}"`,
    `"Status","${pipeline.status}"`,
    `"Created","${new Date(pipeline.createdAt).toLocaleDateString()}"`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pipeline.projectName.replace(/\s+/g, '_')}_pipeline.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPipelineToJSON(pipeline: Pipeline) {
  const json = JSON.stringify(pipeline, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pipeline.projectName.replace(/\s+/g, '_')}_pipeline.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}