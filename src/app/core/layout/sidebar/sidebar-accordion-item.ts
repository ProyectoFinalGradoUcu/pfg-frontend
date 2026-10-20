import { CommonModule } from '@angular/common';
import { Component, ContentChild, Input, OnInit, TemplateRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';

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

  readonly expanded = signal(false);
  private readonly router = inject(Router);
  readonly url = signal(this.router.url);

  ngOnInit(): void {
    if (this.router.url.startsWith(this.route)) {
      this.expanded.set(true);
    }
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        if (e.urlAfterRedirects.startsWith(this.route)) {
          this.expanded.set(true);
        }
      });
  }

  esActivo(child: AccordionChild): boolean {
    const url = this.url().split(/[?#]/)[0];
    const dentro = (ruta: string) => url === ruta || url.startsWith(`${ruta}/`);
    return dentro(child.route) && !(child.excluir ?? []).some(dentro);
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }
}
