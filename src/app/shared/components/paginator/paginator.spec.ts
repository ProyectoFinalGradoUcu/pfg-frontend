import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Paginator } from './paginator';

describe('Paginator', () => {
  let fixture: ComponentFixture<Paginator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [Paginator] }).compileComponents();
    fixture = TestBed.createComponent(Paginator);
  });

  function render(totalItems: number, pageSize = 10): HTMLElement {
    fixture.componentInstance.totalItems = totalItems;
    fixture.componentInstance.pageSize = pageSize;
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('no se muestra sin resultados', () => {
    expect(render(0).querySelector('nav')).toBeNull();
  });

  it('no se muestra si todo entra en una página', () => {
    expect(render(3).querySelector('nav')).toBeNull();
    expect(render(10).querySelector('nav')).toBeNull();
  });

  it('se muestra con más de una página', () => {
    const nav = render(11).querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav!.textContent).toContain('de');
    expect(nav!.querySelectorAll('.paginator__btn').length).toBe(4); // ‹ 1 2 ›
  });
});
