import { CommonModule } from '@angular/common';
import { Component, ContentChild, DestroyRef, Input, OnInit, TemplateRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';
import { SidebarAccordionState } from './sidebar-accordion-state';

export interface AccordionChild {
  label: string;
  route: string;
  /** Subrutas que tienen su propio ítem y no deben marcar a este como activo. */
  excluir?: string[];
}

@Component({
  selector: 'app-sidebar-accordion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-accordion-item.html',
  encapsulation: ViewEncapsulation.None,
})
export class SidebarAccordionItem implements OnInit {
  @Input() label = '';
  @Input() route = '';
  @Input() collapsed = false;
  @Input() children: AccordionChild[] = [];

  @ContentChild(TemplateRef) iconTemplate!: TemplateRef<unknown>;

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = inject(SidebarAccordionState);
  readonly url = signal(this.router.url);
  readonly expanded = computed(() => this.state.abierto() === this.route);

  ngOnInit(): void {
    if (this.router.url.startsWith(this.route)) {
      this.state.abierto.set(this.route);
    }
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        if (e.urlAfterRedirects.startsWith(this.route)) {
          this.state.abierto.set(this.route);
        }
      });
  }

  esActivo(child: AccordionChild): boolean {
    const url = this.url().split(/[?#]/)[0];
    const dentro = (ruta: string) => url === ruta || url.startsWith(`${ruta}/`);
    return dentro(child.route) && !(child.excluir ?? []).some(dentro);
  }

  toggle(): void {
    this.state.abierto.set(this.expanded() ? null : this.route);
  }
}
