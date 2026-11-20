import { JsonPipe } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-model-viewer',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './model-viewer.component.html',
  styleUrl: './model-viewer.component.scss',
})
export class ModelViewerComponent {
  readonly model = input.required<unknown>();
  readonly status = input<string>('');
  readonly lastSubmit = input<unknown>(null);
}
