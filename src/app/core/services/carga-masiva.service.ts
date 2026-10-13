import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { CargaMasivaConfig, CargaMasivaResult } from '../models/carga-masiva.models';

/** Endpoints de las cargas masivas, para no repetir las rutas en cada página. */
export const CARGAS_MASIVAS = {
  personal: {
    titulo: 'Importar personal',
    descripcion: 'Oficiales, subalternos y civiles con sus datos militares y de legajo.',
    urlPlantilla: `${API_BASE_URL}/personas/plantilla`,
    urlCarga: `${API_BASE_URL}/personas/carga-masiva`,
    nombrePlantilla: 'plantilla_personal.xlsx',
  },
  historialCursos: {
    titulo: 'Importar historial de cursos',
    descripcion: 'Cursos realizados por cada funcionario, con su resultado y calificación.',
    urlPlantilla: `${API_BASE_URL}/cursos/carga-masiva/plantilla`,
    urlCarga: `${API_BASE_URL}/cursos/carga-masiva`,
    nombrePlantilla: 'plantilla_historial_cursos.xlsx',
    notas: [
      'Los funcionarios tienen que estar cargados en Personal y los cursos en el catálogo.',
      'Solo los cursos con resultado "Aprobado" cuentan para los requisitos de ascenso.',
    ],
  },
  destinos: {
    titulo: 'Importar destinos',
    descripcion: 'Destino actual e historial de pases de cada funcionario.',
    urlPlantilla: `${API_BASE_URL}/destinos/carga-masiva/plantilla`,
    urlCarga: `${API_BASE_URL}/destinos/carga-masiva`,
    nombrePlantilla: 'plantilla_destinos.xlsx',
    notas: ['Fila sin fecha de fin = destino actual. Fila con fecha de fin = historial.'],
  },
  misiones: {
    titulo: 'Importar misiones y participantes',
    descripcion: 'Funcionarios designados en cada misión. Las misiones y convocatorias nuevas se crean solas.',
    urlPlantilla: `${API_BASE_URL}/misiones/carga-masiva/plantilla`,
    urlCarga: `${API_BASE_URL}/misiones/carga-masiva`,
    nombrePlantilla: 'plantilla_misiones.xlsx',
    notas: ['Una fila por funcionario. Las filas con la misma misión, N.º de orden y boletín forman una convocatoria.'],
  },
} satisfies Record<string, CargaMasivaConfig>;

@Injectable({ providedIn: 'root' })
export class CargaMasivaService {
  private readonly http = inject(HttpClient);

  /** Descarga la plantilla y la guarda con su nombre. Emite cuando terminó (o falla). */
  descargarPlantilla(config: CargaMasivaConfig): Observable<Blob> {
    return this.http.get(config.urlPlantilla, { responseType: 'blob', withCredentials: true }).pipe(
      tap((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = config.nombrePlantilla;
        a.click();
        URL.revokeObjectURL(url);
      }),
    );
  }

  procesar(config: CargaMasivaConfig, archivo: File): Observable<CargaMasivaResult> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<CargaMasivaResult>(config.urlCarga, formData, { withCredentials: true });
  }
}
