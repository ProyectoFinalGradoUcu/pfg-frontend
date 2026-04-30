import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

@Component({
  selector: 'app-paginator',
  standalone: false,
  templateUrl: './paginator.html',
  styleUrl: './paginator.scss',
})
export class Paginator {
  private readonly totalSignal = signal(0);
  private readonly pageSizeSignal = signal(10);
  private readonly currentSignal = signal(1);

  @Input() set totalItems(value: number) {
    this.totalSignal.set(value);
  }
  get totalItems(): number {
    return this.totalSignal();
  }

  @Input() set pageSize(value: number) {
    this.pageSizeSignal.set(value);
  }
  get pageSize(): number {
    return this.pageSizeSignal();
  }

  @Input() set currentPage(value: number) {
    this.currentSignal.set(value);
  }
  get currentPage(): number {
    return this.currentSignal();
  }

  @Output() pageChange = new EventEmitter<number>();

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalSignal() / this.pageSizeSignal())),
  );

  readonly pages = computed<(number | 'gap')[]>(() => {
    const total = this.totalPages();
    const current = this.currentSignal();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | 'gap')[] = [1];
    if (current > 3) pages.push('gap');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('gap');
    pages.push(total);
    return pages;
  });

  readonly rangeStart = computed(() =>
    this.totalSignal() === 0 ? 0 : (this.currentSignal() - 1) * this.pageSizeSignal() + 1,
  );

  readonly rangeEnd = computed(() =>
    Math.min(this.currentSignal() * this.pageSizeSignal(), this.totalSignal()),
  );

  goTo(page: number | 'gap'): void {
    if (page === 'gap') return;
    const total = this.totalPages();
    if (page < 1 || page > total || page === this.currentSignal()) return;
    this.currentSignal.set(page);
    this.pageChange.emit(page);
  }

  next(): void {
    this.goTo(this.currentSignal() + 1);
  }

  prev(): void {
    this.goTo(this.currentSignal() - 1);
  }
}
