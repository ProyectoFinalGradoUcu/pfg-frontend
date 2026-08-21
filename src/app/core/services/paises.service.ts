import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface PaisOpcion {
  label: string;
  value: string;
}

// Lista estática de países en español. Se sirve localmente (sin llamada a una
// API externa) porque el interceptor global de la app fuerza withCredentials:
// true en todas las requests, y eso rompe el CORS de APIs públicas como
// restcountries.com (no aceptan credentials con Access-Control-Allow-Origin: *).
// Si en el futuro se quiere una fuente dinámica, alcanza con reemplazar el
// cuerpo de getPaises() por una llamada HTTP (propia o a un backend interno).
const PAISES: string[] = [
  'Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda',
  'Arabia Saudita', 'Argelia', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaiyán', 'Bahamas', 'Bangladés', 'Barbados', 'Baréin', 'Bélgica', 'Belice',
  'Benín', 'Bielorrusia', 'Birmania (Myanmar)', 'Bolivia', 'Bosnia y Herzegovina',
  'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Bután',
  'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Catar', 'Chad', 'Chile', 'China',
  'Chipre', 'Ciudad del Vaticano', 'Colombia', 'Comoras', 'Corea del Norte',
  'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia', 'Cuba', 'Dinamarca',
  'Dominica', 'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea',
  'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos', 'Estonia', 'Esuatini',
  'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia',
  'Georgia', 'Ghana', 'Granada', 'Grecia', 'Guatemala', 'Guyana', 'Guinea',
  'Guinea-Bisáu', 'Guinea Ecuatorial', 'Haití', 'Honduras', 'Hungría', 'India',
  'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall',
  'Islas Salomón', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania', 'Kazajistán',
  'Kenia', 'Kirguistán', 'Kiribati', 'Kosovo', 'Kuwait', 'Laos', 'Lesoto', 'Letonia',
  'Líbano', 'Liberia', 'Libia', 'Liechtenstein', 'Lituania', 'Luxemburgo',
  'Macedonia del Norte', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Malí',
  'Malta', 'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia',
  'Moldavia', 'Mónaco', 'Mongolia', 'Montenegro', 'Mozambique', 'Namibia', 'Nauru',
  'Nepal', 'Nicaragua', 'Níger', 'Nigeria', 'Noruega', 'Nueva Zelanda', 'Omán',
  'Países Bajos', 'Pakistán', 'Palaos', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay',
  'Perú', 'Polonia', 'Portugal', 'Reino Unido', 'República Centroafricana',
  'República Checa', 'República Democrática del Congo', 'República del Congo',
  'República Dominicana', 'Ruanda', 'Rumania', 'Rusia', 'Samoa', 'San Cristóbal y Nieves',
  'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia',
  'Sri Lanka', 'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam',
  'Tailandia', 'Tanzania', 'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga',
  'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía', 'Tuvalu', 'Ucrania',
  'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Venezuela', 'Vietnam', 'Yemen',
  'Yibuti', 'Zambia', 'Zimbabue',
];

@Injectable({ providedIn: 'root' })
export class PaisesService {
  private readonly paises: PaisOpcion[] = PAISES.sort((a, b) => a.localeCompare(b, 'es')).map(
    (p) => ({ label: p, value: p }),
  );

  getPaises(): Observable<PaisOpcion[]> {
    return of(this.paises);
  }
}
