import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly links = [
    { path: '/dependientes', label: '1 · Campos dependientes' },
    { path: '/validacion', label: '2 · Validación de negocio' },
    { path: '/remoto', label: '3 · Esquema remoto' },
    { path: '/listas', label: '4 · Listas repetibles' },
    { path: '/tablas', label: '5 · Tablas de datos' },
    { path: '/editor', label: '6 · Editor en vivo' },
  ];
}
