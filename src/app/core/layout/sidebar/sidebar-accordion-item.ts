import { CommonModule } from '@angular/common';
import { Component, ContentChild, Input, OnInit, TemplateRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';

export interface AccordionChild {
  label: string;
  route: string;
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

  ngOnInit(): void {
    if (this.router.url.startsWith(this.route)) {
      this.expanded.set(true);
    }
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects.startsWith(this.route)) {
          this.expanded.set(true);
        }
      });
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }
}
