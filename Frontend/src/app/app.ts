import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppAlertComponent } from './core/ui/app-alert.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppAlertComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App { }
