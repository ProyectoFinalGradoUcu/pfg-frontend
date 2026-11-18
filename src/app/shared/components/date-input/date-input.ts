import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface PanelPos {
  top: number | null;
  bottom: number | null;
  left: number;
}

export interface CeldaDia {
  fecha: string;
  dia: number;
  seleccionado: boolean;
  esHoy: boolean;
  deshabilitado: boolean;
  etiqueta: string;
}

const dos = (n: number): string => String(n).padStart(2, '0');

/** Se arma a mano: `toISOString` pasa a UTC y de noche devolvería el día siguiente. */
const aIso = (anio: number, mes: number, dia: number): string =>
  `${anio}-${dos(mes + 1)}-${dos(dia)}`;

const hoyIso = (): string => {
  const d = new Date();
  return aIso(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * Selector de fecha con el aspecto de app-select: muestra dd/mm/aaaa y abre un calendario propio
 * en lugar del del navegador. El valor del control es `aaaa-mm-dd`, igual que un input date, y
 * vacío es ''.
 */
@Component({
  selector: 'app-date-input',
  standalone: false,
  templateUrl: './date-input.html',
  styleUrl: './date-input.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInput),
      multi: true,
    },
  ],
})
export class DateInput implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input() placeholder = 'Seleccionar fecha';
  @Input() clearable = true;

  /** Límites `aaaa-mm-dd`: los días fuera de rango se ven pero no se pueden elegir. */
  @Input() set min(valor: string | null | undefined) {
    this.minimo.set(valor || null);
  }
  @Input() set max(valor: string | null | undefined) {
    this.maximo.set(valor || null);
  }

  @ViewChild('controlRef') controlRef?: ElementRef<HTMLElement>;

  readonly diasSemana = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  readonly abierto = signal(false);
  readonly deshabilitado = signal(false);
  readonly valor = signal('');
  readonly panelPos = signal<PanelPos | null>(null);
  readonly flipUp = signal(false);
  private readonly minimo = signal<string | null>(null);
  private readonly maximo = signal<string | null>(null);
  /** Mes en pantalla: se navega sin tocar el valor elegido. */
  private readonly visible = signal(this.mesDe(hoyIso()));

  readonly texto = computed(() => {
    const [anio, mes, dia] = this.valor().split('-');
    return dia ? `${dia}/${mes}/${anio}` : null;
  });

  readonly tituloMes = computed(() => {
    const { anio, mes } = this.visible();
    return `${MESES[mes]} ${anio}`;
  });

  /** Una celda por día, más los huecos para que el mes arranque en su día de la semana. */
  readonly celdas = computed<(CeldaDia | null)[]>(() => {
    const { anio, mes } = this.visible();
    const hoy = hoyIso();
    const seleccionada = this.valor();
    // getDay() arranca en domingo y la grilla en lunes.
    const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const totalDias = new Date(anio, mes + 1, 0).getDate();

    const dias = Array.from({ length: totalDias }, (_, i): CeldaDia => {
      const dia = i + 1;
      const fecha = aIso(anio, mes, dia);
      return {
        fecha,
        dia,
        seleccionado: fecha === seleccionada,
        esHoy: fecha === hoy,
        deshabilitado: this.fueraDeRango(fecha),
        etiqueta: `${dia} de ${MESES[mes].toLowerCase()} de ${anio}`,
      };
    });
    return [...Array<null>(huecos).fill(null), ...dias];
  });

  readonly hoyDeshabilitado = computed(() => this.fueraDeRango(hoyIso()));

  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  /** Aire mínimo entre el panel y el borde del viewport. */
  private static readonly MARGEN = 8;
  /** Medidas del panel: se calcula antes de que exista para decidir hacia dónde abre. */
  private static readonly ANCHO_PANEL = 288;
  private static readonly ALTO_PANEL = 350;

  constructor() {
    // Capture: los eventos `scroll` de un contenedor interno no burbujean.
    const reposicionar = () => {
      if (this.abierto()) this.posicionarPanel();
    };
    window.addEventListener('scroll', reposicionar, true);
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', reposicionar, true));
  }

  writeValue(valor: string | null): void {
    this.valor.set(valor ? valor.slice(0, 10) : '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
    if (deshabilitado) this.abierto.set(false);
  }

  alternar(): void {
    if (this.deshabilitado()) return;
    if (this.abierto()) {
      this.abierto.set(false);
      return;
    }
    this.visible.set(this.mesDe(this.valor() || this.fechaInicial()));
    this.posicionarPanel();
    this.abierto.set(true);
  }

  moverMes(cantidad: number): void {
    const { anio, mes } = this.visible();
    const destino = new Date(anio, mes + cantidad, 1);
    this.visible.set({ anio: destino.getFullYear(), mes: destino.getMonth() });
  }

  elegir(fecha: string): void {
    if (this.fueraDeRango(fecha)) return;
    this.emitir(fecha);
    this.abierto.set(false);
  }

  elegirHoy(): void {
    this.elegir(hoyIso());
  }

  limpiar(evento: Event): void {
    evento.stopPropagation();
    this.emitir('');
    this.abierto.set(false);
  }

  trackCelda = (indice: number, celda: CeldaDia | null): string =>
    celda?.fecha ?? `hueco-${indice}`;

  @HostListener('window:resize')
  onResize(): void {
    if (this.abierto()) this.posicionarPanel();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(evento: MouseEvent): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    // composedPath se calcula al dispatch: robusto aunque el nodo se re-renderice.
    const camino = (evento.composedPath?.() ?? []) as EventTarget[];
    if (camino.includes(host) || host.contains(evento.target as Node)) return;
    this.abierto.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.abierto.set(false);
  }

  private emitir(valor: string): void {
    this.valor.set(valor);
    this.onChange(valor);
    this.onTouched();
  }

  private fueraDeRango(fecha: string): boolean {
    const minimo = this.minimo();
    const maximo = this.maximo();
    return (minimo !== null && fecha < minimo) || (maximo !== null && fecha > maximo);
  }

  /** Sin valor abre en hoy, salvo que los límites dejen ese mes afuera. */
  private fechaInicial(): string {
    const hoy = hoyIso();
    const maximo = this.maximo();
    const minimo = this.minimo();
    if (maximo && hoy > maximo) return maximo;
    if (minimo && hoy < minimo) return minimo;
    return hoy;
  }

  private mesDe(fecha: string): { anio: number; mes: number } {
    const [anio, mes] = fecha.split('-').map(Number);
    return { anio, mes: mes - 1 };
  }

  private posicionarPanel(): void {
    const control: HTMLElement =
      this.controlRef?.nativeElement ?? (this.elementRef.nativeElement as HTMLElement);
    const rect = control.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rect.bottom - DateInput.MARGEN;
    const espacioArriba = rect.top - DateInput.MARGEN;
    const haciaArriba = espacioAbajo < DateInput.ALTO_PANEL && espacioArriba > espacioAbajo;
    const limiteDerecho = window.innerWidth - DateInput.ANCHO_PANEL - DateInput.MARGEN;

    this.flipUp.set(haciaArriba);
    this.panelPos.set({
      top: haciaArriba ? null : rect.bottom + 4,
      bottom: haciaArriba ? window.innerHeight - rect.top + 4 : null,
      left: Math.max(DateInput.MARGEN, Math.min(rect.left, limiteDerecho)),
    });
  }
}
