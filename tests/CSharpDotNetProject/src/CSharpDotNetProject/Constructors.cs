namespace CSharpDotNetProject;

public class PrimaryConstructorClass(int Int, string String)
{
    public int Int { get; } = Int;
    public string String { get; } = String;

    public PrimaryConstructorClass() : this(0, "Default")
    {
        Console.WriteLine("Default constructor called");
    }

    static PrimaryConstructorClass()
    {
        Console.WriteLine("Static constructor called");
    }

    public override string ToString()
    {
        return $"Int: {Int}, String: {String}";
    }
}