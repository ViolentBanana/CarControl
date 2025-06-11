//
//  CarControlWidget.swift
//  CarControlWidget
//
//  Created by CHEN on 2025/6/3.
//

import WidgetKit
import SwiftUI

let kind = "CarControlWidget"

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), emoji: "😀")
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), emoji: "😀")
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let currentDate = Date()
        var entries: [SimpleEntry] = []

        for hourOffset in 0..<5 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            entries.append(SimpleEntry(date: entryDate, emoji: "😀"))
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let emoji: String
}

struct CarControlWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            CarControlWidgetEntryView(entry: entry) // ✅ 使用你的视图
        }
        .configurationDisplayName("车控小组件")
        .description("可直接操作尾箱、开锁、锁门")
    }
}



struct CarControlWidget_Previews: PreviewProvider {
    static var previews: some View {
        CarControlWidgetEntryView(entry: SimpleEntry(date: Date(), emoji: "😀"))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}
