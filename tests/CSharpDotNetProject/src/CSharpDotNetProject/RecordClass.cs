namespace CSharpDotNetProject;

public record struct RecordStruct(string Name, int Age)
{
    public string Name { get; set; } = Name;
    public int Age { get; set; } = Age;
}

public record class RecordClassWithNoBody(string Name, int Age);

public record struct RecordStructWithNoBody(string Name, int Age);

public record class RecordClass(string Name, int Age)
{
    public string Name { get; set; } = Name;
    public Foo F { get; set; } = new();
    public RecordStruct RecordStruct { get; set; } = new RecordStruct("RecordStruct", 1);
    public int Age { get; set; } = Age;
}

public class Foo
{
}