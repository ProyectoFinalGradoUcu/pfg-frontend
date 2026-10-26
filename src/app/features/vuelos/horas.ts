const FORMATO = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "1.531,0" — las horas con un decimal y coma, como en la planilla. */
export const formatoHoras = (n: number | null | undefined): string => FORMATO.format(n ?? 0);

/** "(Av.)" → "Av.": en la tabla va en la línea de datos del funcionario. */
export const sinParentesis = (texto: string | null | undefined): string => (texto ?? '').replace(/[()]/g, '').trim();
